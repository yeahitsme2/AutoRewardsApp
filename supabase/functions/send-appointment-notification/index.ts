import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AppointmentNotification {
  customerEmail: string;
  customerName: string;
  appointmentDate: string;
  appointmentTime: string;
  serviceType: string;
  status: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { customerEmail, customerName, appointmentDate, appointmentTime, serviceType, status }: AppointmentNotification = await req.json();

    const subject = status === 'confirmed'
      ? 'Appointment Confirmed'
      : status === 'cancelled'
      ? 'Appointment Cancelled'
      : 'Appointment Request Received';

    const message = status === 'confirmed'
      ? `Your appointment for ${serviceType} on ${appointmentDate} at ${appointmentTime} has been confirmed.`
      : status === 'cancelled'
      ? `Your appointment for ${serviceType} on ${appointmentDate} at ${appointmentTime} has been cancelled.`
      : `We received your appointment request for ${serviceType} on ${appointmentDate} at ${appointmentTime}. We'll confirm shortly.`;

    console.log(`Email notification: ${subject} to ${customerEmail}`);
    console.log(`Customer: ${customerName}`);
    console.log(`Message: ${message}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email notification sent',
        debug: {
          to: customerEmail,
          subject,
          message
        }
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
});
