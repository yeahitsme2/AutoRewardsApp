import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface AnalyzedData {
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  vin?: string;
  vehicle_year?: number;
  vehicle_make?: string;
  vehicle_model?: string;
  service_date?: string;
  total_amount?: number;
  parts_cost?: number;
  labor_cost?: number;
  service_writer?: string;
  license_plate?: string;
}

interface SplitResult {
  file_url: string;
  analyzed: AnalyzedData;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const shop_id = formData.get('shop_id') as string;

    if (!file || !shop_id) {
      return new Response(
        JSON.stringify({ error: 'Missing file or shop_id' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Processing PDF file:', file.name, 'Size:', file.size);

    const fileBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(fileBuffer);
    const totalPages = pdfDoc.getPageCount();

    console.log('Total pages in PDF:', totalPages);

    const pageTexts: string[] = [];
    for (let i = 0; i < totalPages; i++) {
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);

      const pageBytes = await singlePageDoc.save();
      const pageText = await extractTextFromPDF(pageBytes.buffer);
      pageTexts.push(pageText);
    }

    const roRanges = detectRepairOrderRanges(pageTexts);
    console.log('Detected repair order ranges:', roRanges);

    const results: SplitResult[] = [];

    for (const range of roRanges) {
      const splitDoc = await PDFDocument.create();

      for (let i = range.start; i <= range.end; i++) {
        const [copiedPage] = await splitDoc.copyPages(pdfDoc, [i]);
        splitDoc.addPage(copiedPage);
      }

      const splitPdfBytes = await splitDoc.save();

      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`;
      const filePath = `${shop_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('repair-orders')
        .upload(filePath, splitPdfBytes, {
          contentType: 'application/pdf',
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('repair-orders')
        .getPublicUrl(filePath);

      const combinedText = pageTexts.slice(range.start, range.end + 1).join(' ');
      const analyzedData = extractDataFromText(combinedText);

      results.push({
        file_url: urlData.publicUrl,
        analyzed: analyzedData,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: results.length,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error splitting repair orders:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to split repair orders',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function detectRepairOrderRanges(pageTexts: string[]): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];

  const roIndicators = [
    /REPAIR\s*ORDER/i,
    /R\.?O\.?\s*#?\s*\d+/i,
    /SERVICE\s*INVOICE/i,
    /WORK\s*ORDER/i,
    /INVOICE\s*#?\s*\d+/i,
  ];

  let currentStart = 0;

  for (let i = 0; i < pageTexts.length; i++) {
    const text = pageTexts[i];
    const hasROIndicator = roIndicators.some(pattern => pattern.test(text));

    if (hasROIndicator && i > 0) {
      ranges.push({ start: currentStart, end: i - 1 });
      currentStart = i;
    }
  }

  ranges.push({ start: currentStart, end: pageTexts.length - 1 });

  return ranges.filter(range => range.start <= range.end);
}

async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    const uint8Array = new Uint8Array(buffer);
    const decoder = new TextDecoder('latin1');
    let text = decoder.decode(uint8Array);

    text = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, ' ');

    const streamMatches = text.match(/stream\s+([\s\S]*?)\s+endstream/g);
    if (streamMatches) {
      const extractedText = streamMatches.map(match => {
        const content = match.replace(/^stream\s+/, '').replace(/\s+endstream$/, '');
        return content;
      }).join(' ');
      text = extractedText;
    }

    text = text.replace(/[^\x20-\x7E\n\r]/g, ' ');
    text = text.replace(/\s+/g, ' ');

    return text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return '';
  }
}

function extractDataFromText(text: string): AnalyzedData {
  const data: AnalyzedData = {};

  const namePatterns = [
    /([A-Z]{2,}[A-Z\s,]+[A-Z]{2,})/,
    /(?:Customer|Name|Client)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /([A-Z][A-Z]+,\s*[A-Z][a-z]+)/,
  ];
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      let name = match[1].trim();
      if (name.includes(',')) {
        const parts = name.split(',').map(p => p.trim());
        name = `${parts[1]} ${parts[0]}`;
      }
      if (name.length > 5 && name.length < 50) {
        data.customer_name = name;
        break;
      }
    }
  }

  const phonePatterns = [
    /Phone[\s:]*(\d{1}\s*\(\d{3}\)\s*\d{3}-\d{4})/i,
    /(?:Phone|Tel|Mobile)[\s:]*(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/i,
    /(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/,
  ];
  for (const pattern of phonePatterns) {
    const phoneMatch = text.match(pattern);
    if (phoneMatch) {
      data.customer_phone = phoneMatch[1].replace(/[^\d]/g, '');
      break;
    }
  }

  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const emailMatch = text.match(emailPattern);
  if (emailMatch) {
    data.customer_email = emailMatch[1];
  }

  const vinPatterns = [
    /VIN[\s:]*([A-HJ-NPR-Z0-9]{17})/i,
    /(?:Vehicle Identification)[\s:]*([A-HJ-NPR-Z0-9]{17})/i,
    /([A-HJ-NPR-Z0-9]{17})/,
  ];
  for (const pattern of vinPatterns) {
    const vinMatch = text.match(pattern);
    if (vinMatch && vinMatch[1].length === 17) {
      data.vin = vinMatch[1];
      break;
    }
  }

  const vehiclePattern = /(\d{4})\s+([A-Z][A-Za-z]+)\s+([A-Z][A-Za-z0-9\s]+?)(?:\s+(?:VIN|V8|V6|DOHC|$))/;
  const vehicleMatch = text.match(vehiclePattern);
  if (vehicleMatch) {
    data.vehicle_year = parseInt(vehicleMatch[1]);
    data.vehicle_make = vehicleMatch[2];
    data.vehicle_model = vehicleMatch[3].trim();
  }

  const licensePlatePattern = /(?:License|Plate|LP)[\s:]*([A-Z0-9]{2,8})/i;
  const licensePlateMatch = text.match(licensePlatePattern);
  if (licensePlateMatch) {
    data.license_plate = licensePlateMatch[1];
  }

  const datePatterns = [
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    /(\d{4}-\d{2}-\d{2})/,
  ];
  for (const pattern of datePatterns) {
    const dateMatch = text.match(pattern);
    if (dateMatch) {
      data.service_date = parseDate(dateMatch[1]);
      break;
    }
  }

  const totalPatterns = [
    /(?:TOTAL|Total|REPAIR ORDER TOTAL)[\s:$]*(\d+[,]?\d*\.?\d{2})/i,
    /(?:Grand Total|Final Total)[\s:$]*(\d+[,]?\d*\.?\d{2})/i,
  ];
  for (const pattern of totalPatterns) {
    const totalMatch = text.match(pattern);
    if (totalMatch) {
      data.total_amount = parseFloat(totalMatch[1].replace(/,/g, ''));
      break;
    }
  }

  const partsPattern = /(?:PARTS|Parts|Total Parts)[\s:$]*(\d+[,]?\d*\.?\d{2})/i;
  const partsMatch = text.match(partsPattern);
  if (partsMatch) {
    data.parts_cost = parseFloat(partsMatch[1].replace(/,/g, ''));
  }

  const laborPattern = /(?:LABOR|Labor|Total Labor)[\s:$]*(\d+[,]?\d*\.?\d{2})/i;
  const laborMatch = text.match(laborPattern);
  if (laborMatch) {
    data.labor_cost = parseFloat(laborMatch[1].replace(/,/g, ''));
  }

  const serviceWriterPatterns = [
    /(?:Service Writer|Writer|Advisor|Today Is)[\s:]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /Your Service Writer Today Is[\s:]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
  ];
  for (const pattern of serviceWriterPatterns) {
    const serviceWriterMatch = text.match(pattern);
    if (serviceWriterMatch && serviceWriterMatch[1].length > 3) {
      data.service_writer = serviceWriterMatch[1];
      break;
    }
  }

  return data;
}

function parseDate(dateStr: string): string {
  try {
    if (dateStr.includes('-')) {
      return dateStr;
    }

    const parts = dateStr.split('/');
    if (parts.length === 3) {
      let [month, day, year] = parts;

      if (year.length === 2) {
        const currentYear = new Date().getFullYear();
        const century = Math.floor(currentYear / 100) * 100;
        year = (century + parseInt(year)).toString();
      }

      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toISOString().split('T')[0];
    }
  } catch (error) {
    console.error('Error parsing date:', error);
  }

  return new Date().toISOString().split('T')[0];
}
