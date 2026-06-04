import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  
  try {
    // Obtener toda la información del negocio desde app_settings
    const { data: settings, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', [
        'business_name',
        'business_legal_name',
        'business_address',
        'business_phone',
        'business_email',
        'business_start_date',
        'business_iva_condition',
        'business_iibb',
        'afip_cuit',
        'afip_point_of_sale',
      ]);

    if (error) {
      console.error('Error fetching business info:', error);
      return NextResponse.json({ 
        success: false, 
        message: 'Error al obtener información del negocio',
        data: null 
      }, { status: 500 });
    }

    // Convertir array de settings a objeto
    const businessInfo = settings?.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);

    return NextResponse.json({ 
      success: true, 
      data: businessInfo 
    });

  } catch (error: any) {
    console.error('Error in business-info API:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'Error interno del servidor',
      data: null 
    }, { status: 500 });
  }
}

