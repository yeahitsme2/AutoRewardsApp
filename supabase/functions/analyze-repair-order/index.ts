import { createClient } from 'npm:@supabase/supabase-js@2';

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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let file_url: string | undefined;
    let shop_id: string | undefined;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const jsonData = await req.json();
      file_url = jsonData.file_url;
      shop_id = jsonData.shop_id;
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      shop_id = formData.get('shop_id') as string;

      if (!file || !shop_id) {
        return new Response(
          JSON.stringify({
            success: true,
            data: getFallbackData(),
            message: 'Missing file or shop_id, returning default data'
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const fileBuffer = await file.arrayBuffer();
      const analyzedData = await analyzeRepairOrderBuffer(fileBuffer);

      return new Response(
        JSON.stringify({
          success: true,
          data: analyzedData,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!file_url || !shop_id) {
      return new Response(
        JSON.stringify({
          success: true,
          data: getFallbackData(),
          message: 'Missing file_url or shop_id, returning default data'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Analyzing PDF from URL:', file_url);
    const analyzedData = await analyzeRepairOrderFromUrl(file_url);

    return new Response(
      JSON.stringify({
        success: true,
        data: analyzedData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error analyzing repair order:', error);

    return new Response(
      JSON.stringify({
        success: true,
        data: getFallbackData(),
        message: 'Analysis failed, returning default data for manual entry'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function analyzeRepairOrderFromUrl(fileUrl: string): Promise<AnalyzedData> {
  try {
    console.log('Fetching PDF from URL...');
    const response = await fetch(fileUrl);

    if (!response.ok) {
      console.error('Failed to fetch PDF:', response.status, response.statusText);
      return getFallbackData();
    }

    const buffer = await response.arrayBuffer();
    console.log('PDF buffer size:', buffer.byteLength);

    return await analyzeRepairOrderBuffer(buffer);
  } catch (error) {
    console.error('Error fetching file:', error);
    return getFallbackData();
  }
}

async function analyzeRepairOrderBuffer(buffer: ArrayBuffer): Promise<AnalyzedData> {
  try {
    console.log('Extracting text from PDF buffer...');
    const pdfText = await extractTextFromPDF(buffer);
    console.log('Extracted text length:', pdfText.length);
    console.log('First 500 chars:', pdfText.substring(0, 500));

    const data = extractDataFromText(pdfText);
    console.log('Extracted data:', JSON.stringify(data, null, 2));

    return data;
  } catch (error) {
    console.error('Error analyzing PDF:', error);
    return getFallbackData();
  }
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
        console.log('Found customer name:', name);
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
      console.log('Found phone:', data.customer_phone);
      break;
    }
  }

  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const emailMatch = text.match(emailPattern);
  if (emailMatch) {
    data.customer_email = emailMatch[1];
    console.log('Found email:', data.customer_email);
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
      console.log('Found VIN:', data.vin);
      break;
    }
  }

  const vehiclePattern = /(\d{4})\s+([A-Z][A-Za-z]+)\s+([A-Z][A-Za-z0-9\s]+?)(?:\s+(?:VIN|V8|V6|DOHC|$))/;
  const vehicleMatch = text.match(vehiclePattern);
  if (vehicleMatch) {
    data.vehicle_year = parseInt(vehicleMatch[1]);
    data.vehicle_make = vehicleMatch[2];
    data.vehicle_model = vehicleMatch[3].trim();
    console.log('Found vehicle:', data.vehicle_year, data.vehicle_make, data.vehicle_model);
  }

  const licensePlatePattern = /(?:License|Plate|LP)[\s:]*([A-Z0-9]{2,8})/i;
  const licensePlateMatch = text.match(licensePlatePattern);
  if (licensePlateMatch) {
    data.license_plate = licensePlateMatch[1];
    console.log('Found license plate:', data.license_plate);
  }

  const datePatterns = [
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    /(\d{4}-\d{2}-\d{2})/,
  ];
  for (const pattern of datePatterns) {
    const dateMatch = text.match(pattern);
    if (dateMatch) {
      data.service_date = parseDate(dateMatch[1]);
      console.log('Found date:', data.service_date);
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
      console.log('Found total:', data.total_amount);
      break;
    }
  }

  const partsPattern = /(?:PARTS|Parts|Total Parts)[\s:$]*(\d+[,]?\d*\.?\d{2})/i;
  const partsMatch = text.match(partsPattern);
  if (partsMatch) {
    data.parts_cost = parseFloat(partsMatch[1].replace(/,/g, ''));
    console.log('Found parts cost:', data.parts_cost);
  }

  const laborPattern = /(?:LABOR|Labor|Total Labor)[\s:$]*(\d+[,]?\d*\.?\d{2})/i;
  const laborMatch = text.match(laborPattern);
  if (laborMatch) {
    data.labor_cost = parseFloat(laborMatch[1].replace(/,/g, ''));
    console.log('Found labor cost:', data.labor_cost);
  }

  const serviceWriterPatterns = [
    /(?:Service Writer|Writer|Advisor|Today Is)[\s:]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /Your Service Writer Today Is[\s:]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
  ];
  for (const pattern of serviceWriterPatterns) {
    const serviceWriterMatch = text.match(pattern);
    if (serviceWriterMatch && serviceWriterMatch[1].length > 3) {
      data.service_writer = serviceWriterMatch[1];
      console.log('Found service writer:', data.service_writer);
      break;
    }
  }

  return data;
}

function getFallbackData(): AnalyzedData {
  return {
    service_date: new Date().toISOString().split('T')[0],
    total_amount: 0,
    parts_cost: 0,
    labor_cost: 0,
  };
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
