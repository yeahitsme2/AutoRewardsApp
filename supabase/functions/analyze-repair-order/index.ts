import { createClient } from 'npm:@supabase/supabase-js@2';
import { extractText } from 'npm:unpdf@0.11.0';

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
        message: 'Analysis failed, returning default data for manual entry',
        error: error.message || String(error),
        stack: error.stack
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
    console.log('First 1000 chars:', pdfText.substring(0, 1000));
    console.log('Full text (first 2000 chars):', pdfText.substring(0, 2000));

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
    console.log('Attempting to extract text from PDF using unpdf...');

    const { text } = await extractText(uint8Array);

    console.log('Successfully extracted text, length:', text.length);
    console.log('Text preview:', text.substring(0, 500));

    return text;
  } catch (error) {
    console.error('Error extracting text from PDF with unpdf:', error);
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
        console.log('Found customer name:', name);
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
        console.log('Found phone:', data.customer_phone);
        break;
      }
    }
    if (data.customer_phone) break;
  }

  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const emailMatch = text.match(emailPattern);
  if (emailMatch) {
    data.customer_email = emailMatch[1].toLowerCase();
    console.log('Found email:', data.customer_email);
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
        console.log('Found VIN:', data.vin);
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
        console.log('Found vehicle:', data.vehicle_year, data.vehicle_make, data.vehicle_model);
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
        console.log('Found license plate:', data.license_plate);
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
    console.log('Found date:', data.service_date);
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
    console.log('Found total:', data.total_amount);
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
        console.log('Found parts cost:', data.parts_cost);
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
        console.log('Found labor cost:', data.labor_cost);
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
        console.log('Found service writer:', data.service_writer);
        break;
      }
    }
    if (data.service_writer) break;
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
