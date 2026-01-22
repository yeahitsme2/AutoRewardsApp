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

    const { data: formData } = await req.formData().catch(() => ({ data: null }));

    if (!formData) {
      const jsonData = await req.json();
      const { file_url, shop_id } = jsonData;

      if (!file_url || !shop_id) {
        return new Response(
          JSON.stringify({ error: 'Missing file_url or shop_id' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

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
    }

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
  } catch (error: any) {
    console.error('Error analyzing repair order:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function analyzeRepairOrderFromUrl(fileUrl: string): Promise<AnalyzedData> {
  try {
    const response = await fetch(fileUrl);
    const buffer = await response.arrayBuffer();
    return await analyzeRepairOrderBuffer(buffer);
  } catch (error) {
    console.error('Error fetching file:', error);
    return extractFallbackData('');
  }
}

async function analyzeRepairOrderBuffer(buffer: ArrayBuffer): Promise<AnalyzedData> {
  try {
    const pdfText = await extractTextFromPDF(buffer);
    return extractDataFromText(pdfText);
  } catch (error) {
    console.error('Error analyzing PDF:', error);
    return extractFallbackData('');
  }
}

async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    const uint8Array = new Uint8Array(buffer);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let text = decoder.decode(uint8Array);

    text = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, ' ');

    return text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return '';
  }
}

function extractDataFromText(text: string): AnalyzedData {
  const data: AnalyzedData = {};

  const namePatterns = [
    /(?:Customer|Name|Client)[\s:]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /([A-Z][A-Z]+,\s*[A-Z][a-z]+)/,
  ];
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      data.customer_name = match[1].trim();
      break;
    }
  }

  const phonePattern = /(?:Phone|Tel|Mobile)[\s:]*(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/i;
  const phoneMatch = text.match(phonePattern);
  if (phoneMatch) {
    data.customer_phone = phoneMatch[1].replace(/[^\d]/g, '');
  }

  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const emailMatch = text.match(emailPattern);
  if (emailMatch) {
    data.customer_email = emailMatch[1];
  }

  const vinPattern = /(?:VIN|Vehicle Identification)[\s:]*([A-HJ-NPR-Z0-9]{17})/i;
  const vinMatch = text.match(vinPattern);
  if (vinMatch) {
    data.vin = vinMatch[1];
  }

  const vehiclePattern = /(\d{4})\s+([A-Z][A-Za-z]+)\s+([A-Z][A-Za-z0-9\s]+)(?:\s+(?:VIN|V8|V6|DOHC))?/;
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

  const datePattern = /(\d{1,2}\/\d{1,2}\/\d{2,4})/;
  const dateMatch = text.match(datePattern);
  if (dateMatch) {
    data.service_date = parseDate(dateMatch[1]);
  }

  const totalPattern = /(?:TOTAL|Total|REPAIR ORDER TOTAL)[\s:$]*(\d+[,.]?\d*\.?\d{2})/i;
  const totalMatch = text.match(totalPattern);
  if (totalMatch) {
    data.total_amount = parseFloat(totalMatch[1].replace(/,/g, ''));
  }

  const partsPattern = /(?:PARTS|Parts)[\s:$]*(\d+[,.]?\d*\.?\d{2})/i;
  const partsMatch = text.match(partsPattern);
  if (partsMatch) {
    data.parts_cost = parseFloat(partsMatch[1].replace(/,/g, ''));
  }

  const laborPattern = /(?:LABOR|Labor)[\s:$]*(\d+[,.]?\d*\.?\d{2})/i;
  const laborMatch = text.match(laborPattern);
  if (laborMatch) {
    data.labor_cost = parseFloat(laborMatch[1].replace(/,/g, ''));
  }

  const serviceWriterPattern = /(?:Service Writer|Writer|Advisor)[\s:]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i;
  const serviceWriterMatch = text.match(serviceWriterPattern);
  if (serviceWriterMatch) {
    data.service_writer = serviceWriterMatch[1];
  }

  return data;
}

function extractFallbackData(text: string): AnalyzedData {
  return {
    customer_name: undefined,
    customer_phone: undefined,
    vin: undefined,
    service_date: new Date().toISOString().split('T')[0],
    total_amount: 0,
  };
}

function parseDate(dateStr: string): string {
  try {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      let [month, day, year] = parts;

      if (year.length === 2) {
        year = '20' + year;
      }

      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toISOString().split('T')[0];
    }
  } catch (error) {
    console.error('Error parsing date:', error);
  }

  return new Date().toISOString().split('T')[0];
}
