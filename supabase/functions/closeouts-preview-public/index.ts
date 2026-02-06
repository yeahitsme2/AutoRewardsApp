import { serve } from 'https://deno.land/std@0.201.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const toNumber = (value: unknown) => Number(value || 0);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const start = body?.start ? new Date(body.start) : null;
    const end = body?.end ? new Date(body.end) : null;
    const label = body?.label ?? 'Custom';
    const periodType = body?.period_type ?? 'custom';
    const requestedShopId = body?.shop_id ?? null;
    const accessToken = body?.access_token ?? null;
    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    const headerToken = authHeader ? authHeader.replace('Bearer ', '') : null;

    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return new Response(JSON.stringify({ error: 'Invalid date range' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenForUser = accessToken || headerToken;
    if (!tokenForUser) {
      return new Response(JSON.stringify({ error: 'Missing access token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const decodeJwtPayload = (token: string) => {
      const base64 = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
      if (!base64) return null;
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
      try {
        return JSON.parse(atob(padded));
      } catch {
        return null;
      }
    };

    const payload = decodeJwtPayload(tokenForUser);
    if (!payload?.sub || !payload?.iss) {
      return new Response(JSON.stringify({ error: 'Invalid JWT' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (typeof payload.iss === 'string' && !payload.iss.startsWith(supabaseUrl)) {
      return new Response(JSON.stringify({ error: 'Invalid JWT issuer' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const userId = payload.sub as string;

    const { data: superAdmin, error: superAdminError } = await supabase
      .from('super_admins')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (superAdminError) throw superAdminError;

    let shopId: string | null = null;
    if (superAdmin?.id && requestedShopId) {
      shopId = requestedShopId;
    } else {
      const { data: admin, error: adminError } = await supabase
        .from('admins')
        .select('shop_id, is_active')
        .eq('auth_user_id', userId)
        .maybeSingle();
      if (adminError) throw adminError;
      if (!admin?.shop_id || admin.is_active === false) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      shopId = admin.shop_id;
    }

    if (!shopId) {
      return new Response(JSON.stringify({ error: 'Missing shop context' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: repairOrders, error: roError } = await supabase
      .from('repair_orders')
      .select('id, ro_number, customer_id, vehicle_id, labor_total, parts_total, fees_total, tax_total, grand_total, supplies_amount, closed_at, status')
      .eq('shop_id', shopId)
      .eq('status', 'closed')
      .gte('closed_at', start.toISOString())
      .lt('closed_at', end.toISOString());
    if (roError) throw roError;

    const roList = repairOrders || [];
    const roIds = roList.map((ro) => ro.id);
    const customerIds = Array.from(new Set(roList.map((ro) => ro.customer_id).filter(Boolean)));
    const vehicleIds = Array.from(new Set(roList.map((ro) => ro.vehicle_id).filter(Boolean)));

    const [customersResponse, vehiclesResponse] = await Promise.all([
      customerIds.length
        ? supabase.from('customers').select('id, full_name, email').in('id', customerIds)
        : Promise.resolve({ data: [], error: null }),
      vehicleIds.length
        ? supabase.from('vehicles').select('id, year, make, model, vin').in('id', vehicleIds as string[])
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (customersResponse.error) throw customersResponse.error;
    if (vehiclesResponse.error) throw vehiclesResponse.error;

    const customerMap = new Map((customersResponse.data || []).map((row: any) => [row.id, row]));
    const vehicleMap = new Map((vehiclesResponse.data || []).map((row: any) => [row.id, row]));

    const { data: laborItems, error: laborError } = roIds.length
      ? await supabase
        .from('repair_order_items')
        .select('repair_order_id, labor_hours, status')
        .in('repair_order_id', roIds)
        .eq('item_type', 'labor')
        .neq('status', 'declined')
      : { data: [], error: null };
    if (laborError) throw laborError;

    const laborHours = (laborItems || []).reduce((sum: number, item: any) => sum + toNumber(item.labor_hours), 0);

    const salesTotals = roList.reduce(
      (acc, ro) => {
        acc.labor += toNumber(ro.labor_total);
        acc.parts += toNumber(ro.parts_total);
        acc.fees += toNumber(ro.fees_total);
        acc.supplies += toNumber((ro as any).supplies_amount);
        acc.tax += toNumber(ro.tax_total);
        acc.grand += toNumber(ro.grand_total);
        return acc;
      },
      { labor: 0, parts: 0, fees: 0, supplies: 0, tax: 0, grand: 0 }
    );

    const netSales = salesTotals.labor + salesTotals.parts + salesTotals.fees + salesTotals.supplies;
    const carCount = roList.length;
    const averageRepairOrder = carCount > 0 ? netSales / carCount : 0;
    const effectiveLaborRate = laborHours > 0 ? salesTotals.labor / laborHours : null;

    const openStatuses = ['draft', 'awaiting_approval', 'approved', 'inspection_complete'];
    const { count: openRos } = await supabase
      .from('repair_orders')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .in('status', openStatuses);

    const { count: awaitingApproval } = await supabase
      .from('repair_orders')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .eq('status', 'awaiting_approval');

    let partsWaiting = 0;
    if (openRos && openRos > 0) {
      const { data: openRoIds } = await supabase
        .from('repair_orders')
        .select('id')
        .eq('shop_id', shopId)
        .in('status', openStatuses);
      const openIds = (openRoIds || []).map((row: any) => row.id);
      if (openIds.length) {
        const { count } = await supabase
          .from('repair_order_part_reservations')
          .select('id', { count: 'exact', head: true })
          .in('repair_order_id', openIds)
          .in('job_status', ['needed', 'ordered', 'partially_received']);
        partsWaiting = count || 0;
      }
    }

    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select('points_earned, service_date')
      .eq('shop_id', shopId)
      .gte('service_date', start.toISOString())
      .lt('service_date', end.toISOString());
    if (servicesError) throw servicesError;
    const pointsEarned = (services || []).reduce((sum, row) => sum + toNumber(row.points_earned), 0);

    let pointsRedeemed = 0;
    let redemptionData: any[] = [];
    let redemptionError: any = null;
    const redemptionQuery = await supabase
      .from('reward_redemptions')
      .select('points_spent, created_at')
      .eq('shop_id', shopId)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString());
    redemptionData = redemptionQuery.data || [];
    redemptionError = redemptionQuery.error;

    if (redemptionError?.code === '42703') {
      const fallbackQuery = await supabase
        .from('reward_redemptions')
        .select('points_spent, processed_at')
        .eq('shop_id', shopId)
        .gte('processed_at', start.toISOString())
        .lt('processed_at', end.toISOString());
      redemptionData = fallbackQuery.data || [];
      redemptionError = fallbackQuery.error;
    }

    if (!redemptionError) {
      pointsRedeemed = redemptionData.reduce((sum, row) => sum + toNumber(row.points_spent), 0);
    }

    const roRows = roList.map((ro) => {
      const customer = customerMap.get(ro.customer_id);
      const vehicle = ro.vehicle_id ? vehicleMap.get(ro.vehicle_id) : null;
      const vehicleLabel = vehicle
        ? `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim()
        : null;
      const suppliesTotal = toNumber((ro as any).supplies_amount);
      const grandTotal = toNumber(ro.labor_total)
        + toNumber(ro.parts_total)
        + toNumber(ro.fees_total)
        + toNumber(ro.tax_total)
        + suppliesTotal;
      return {
        id: ro.id,
        ro_number: ro.ro_number,
        closed_at: ro.closed_at,
        customer_name: customer?.full_name || customer?.email || null,
        vehicle_label: vehicleLabel,
        labor_total: toNumber(ro.labor_total),
        parts_total: toNumber(ro.parts_total),
        fees_total: toNumber(ro.fees_total),
        supplies_total: suppliesTotal,
        tax_total: toNumber(ro.tax_total),
        grand_total: grandTotal,
      };
    });

    return new Response(JSON.stringify({
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
        label,
        periodType,
      },
      kpis: {
        netSales,
        grossProfit: null,
        grossProfitPercent: null,
        carCount,
        averageRepairOrder,
        hoursSold: laborHours,
        effectiveLaborRate,
      },
      sales: {
        labor: salesTotals.labor,
        parts: salesTotals.parts,
        fees: salesTotals.fees,
        supplies: salesTotals.supplies,
        tax: salesTotals.tax,
        discounts: 0,
      },
      operational: {
        openRos: openRos || 0,
        awaitingApproval: awaitingApproval || 0,
        partsWaiting,
      },
      rewards: {
        pointsEarned,
        pointsRedeemed,
      },
      payments: {},
      roList: roRows,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
