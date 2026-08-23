import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');

    if (!email || !password) {
      return NextResponse.json({ error: 'Ingrese correo y contraseña.' }, { status: 400 });
    }

    const supabase = await createClient();
    const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

    if (isPlaceholder) {
      // Modo desarrollo local: Permitir inicio de sesión directo
      const user = {
        nombre: 'Operador Logístico AMEX',
        rol: 'admin',
        email: email || 'admin@amexcourier.pe',
      };
      return NextResponse.json({ user });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      console.error('[Auth Login]', error?.message || 'Sin sesión');
      return NextResponse.json({ error: 'Credenciales incorrectas. Verifique su correo y contraseña.' }, { status: 401 });
    }

    const user = {
      nombre: (data.user.user_metadata?.nombre_completo as string) || email,
      rol: (data.user.app_metadata?.rol as string) || 'admin',
      email: data.user.email || email,
    };

    return NextResponse.json({ user });
  } catch (err) {
    console.error('[Auth Login Error]', err);
    return NextResponse.json({ error: 'Error interno al iniciar sesión.' }, { status: 500 });
  }
}
