import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import pdfParse from 'npm:pdf-parse@1.1.1';

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
    const bufferNode = Buffer.from(uint8Array);

    const data = await pdfParse(bufferNode);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF with pdf-parse:', error);
    return '';
  }
}

function extractDataFromText(text: string): AnalyzedData {
  const data: AnalyzedData = {};

  const namePatterns = [
    /(?:Customer|Client|Name|Owner)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /([A-Z][A-Z]+,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
    /([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s+(?:Home|Work|Cell|Phone|Email|\d{3}))/i,
  ];
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      let name = match[1].trim();
      if (name.includes(',')) {
        const parts = name.split(',').map(p => p.trim());
        name = `${parts[1]} ${parts[0]}`;
      }
      if (name.length > 5 && name.length < 50 && !/(TOTAL|REPAIR|ORDER|SERVICE|VEHICLE)/i.test(name)) {
        data.customer_name = name;
        break;
      }
    }
  }

  const phonePatterns = [
    /(?:Phone|Tel|Mobile|Cell|Home|Work)[\s:]*(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/gi,
    /(?:^|\s)(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})(?:\s|$)/g,
  ];
  for (const pattern of phonePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const phone = match[1].replace(/[^\d]/g, '');
      if (phone.length === 10) {
        data.customer_phone = phone;
        break;
      }
    }
    if (data.customer_phone) break;
  }

  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const emailMatch = text.match(emailPattern);
  if (emailMatch) {
    data.customer_email = emailMatch[1].toLowerCase();
  }

  const vinPatterns = [
    /(?:VIN|V\.I\.N\.|Vehicle Identification)[\s:#]*([A-HJ-NPR-Z0-9]{17})/gi,
    /\b([A-HJ-NPR-Z0-9]{17})\b/g,
  ];
  for (const pattern of vinPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const vin = match[1].toUpperCase();
      if (vin.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
        data.vin = vin;
        break;
      }
    }
    if (data.vin) break;
  }

  const vehiclePatterns = [
    /(?:Vehicle|Year|Make|Model)[\s:]*(\d{4})[\s,]+([A-Z][A-Za-z]+)[\s,]+([A-Z][A-Za-z0-9\s-]+?)(?:\n|VIN|Engine|$)/i,
    /(\d{4})\s+([A-Z][A-Za-z]+)\s+([A-Z][A-Za-z0-9\s-]+?)(?:\s+(?:VIN|V8|V6|4WD|AWD|FWD|RWD|Engine|\n|$))/i,
  ];
  for (const pattern of vehiclePatterns) {
    const vehicleMatch = text.match(pattern);
    if (vehicleMatch) {
      const year = parseInt(vehicleMatch[1]);
      if (year >= 1990 && year <= new Date().getFullYear() + 1) {
        data.vehicle_year = year;
        data.vehicle_make = vehicleMatch[2].trim();
        data.vehicle_model = vehicleMatch[3].trim().replace(/\s+/g, ' ');
        break;
      }
    }
  }

  const licensePlatePatterns = [
    /(?:License|Plate|Tag|LP|Lic)[\s:#]*([A-Z0-9]{2,8})/gi,
    /(?:Plate|Tag)[\s:#]*([A-Z]{1,3}\s*\d{1,4}[A-Z]?)/gi,
  ];
  for (const pattern of licensePlatePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const plate = match[1].replace(/\s/g, '').toUpperCase();
      if (plate.length >= 2 && plate.length <= 8) {
        data.license_plate = plate;
        break;
      }
    }
    if (data.license_plate) break;
  }

  const datePatterns = [
    /(?:Date|Service Date|Repair Date|RO Date)[\s:]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/gi,
    /(?:Date|Service Date|Repair Date)[\s:]*(\d{4}-\d{2}-\d{2})/gi,
    /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/g,
  ];
  const dates: string[] = [];
  for (const pattern of datePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const parsed = parseDate(match[1]);
      if (parsed) {
        dates.push(parsed);
      }
    }
  }
  if (dates.length > 0) {
    dates.sort();
    data.service_date = dates[0];
  }

  const totalPatterns = [
    /(?:TOTAL|Total Amount|Grand Total|Balance|Amount Due|Final Total)[\s:$]*(\d+[,]?\d*\.?\d{2})/gi,
    /(?:^|\n)TOTAL[\s:$]*(\d+[,]?\d*\.?\d{2})/gi,
  ];
  const totals: number[] = [];
  for (const pattern of totalPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0 && amount < 100000) {
        totals.push(amount);
      }
    }
  }
  if (totals.length > 0) {
    data.total_amount = Math.max(...totals);
  }

  const partsPatterns = [
    /(?:PARTS|Parts Total|Parts Cost|Parts Amount)[\s:$]*(\d+[,]?\d*\.?\d{2})/gi,
  ];
  for (const pattern of partsPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0) {
        data.parts_cost = amount;
        break;
      }
    }
    if (data.parts_cost) break;
  }

  const laborPatterns = [
    /(?:LABOR|Labor Total|Labor Cost|Labor Amount)[\s:$]*(\d+[,]?\d*\.?\d{2})/gi,
  ];
  for (const pattern of laborPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0) {
        data.labor_cost = amount;
        break;
      }
    }
    if (data.labor_cost) break;
  }

  const serviceWriterPatterns = [
    /(?:Service Writer|Service Advisor|Advisor|Writer|Technician)[\s:]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    /(?:Your Service Writer Today Is|Serviced By)[\s:]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
  ];
  for (const pattern of serviceWriterPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const name = match[1].trim();
      if (name.length > 3 && name.length < 50 && !/(TOTAL|REPAIR|ORDER|SERVICE)/i.test(name)) {
        data.service_writer = name;
        break;
      }
    }
    if (data.service_writer) break;
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
