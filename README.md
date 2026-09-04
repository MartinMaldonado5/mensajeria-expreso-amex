# ✈️ SISTEMA AMEX COURIER - Plataforma Logística Integrada v2.0

Sistema ERP de gestión logística integral para **SISTEMA AMEX COURIER** (Sede Central Lince, Miami Hub, Tingo María), desarrollado con arquitectura **Full-Stack de Alto Rendimiento**:

- **Framework Web:** **Next.js 14+ (React 18 / TypeScript)** con App Router y Server Actions.
- **Base de Datos:** **Supabase (PostgreSQL 17)** en la nube con esquemas 100% en español y políticas **Row Level Security (RLS)**.
- **Almacenamiento de Archivos:** **Cloudflare R2 Storage** (compatibilidad S3 API sin costos de transferencia) bajo la carpeta raíz **`FOLDER AMEX`**.
- **IA Integradora:** **Google Gemini 2.0 AI** para lectura y autocompletado inteligente de facturas PDF.
- **Escáner Móvil QR & Barras:** Lector con cámara nativa para celulares, sonido *beep* y respuesta háptica (vibración).
- **Despliegue CI/CD:** **Vercel** (`https://mensajeria-expreso-amex.vercel.app`).

---

## 🏛️ Estructura del Proyecto

```
PROYECTO-AMEXcourrier/
├── app/                        # Next.js App Router (Vistas ERP y API Routes)
│   ├── api/                    # Endpoints Serverless (Uploads R2 y Gemini AI)
│   │   ├── ai/analyze-invoice  # Endpoint analizador de facturas PDF
│   │   └── storage/upload      # Proxy de subida a Cloudflare R2 FOLDER AMEX
│   ├── globals.css             # Tema oficial SAP UI (Inter & JetBrains Mono)
│   ├── layout.tsx              # Root Layout
│   └── page.tsx                # Dashboard principal con todos los módulos
├── components/                 # Componentes React Modulares
│   └── scanner/                # Componente de Escáner Móvil en Tiempo Real
├── lib/                        # Clientes de Servicios
│   ├── gemini/                 # Analizador de facturas Google Gemini AI
│   ├── r2/                     # Cliente S3 SDK para Cloudflare R2 Storage
│   └── supabase/               # Cliente Supabase PostgreSQL
├── public/                     # Recursos estáticos y marcas
├── types/                      # Definiciones TypeScript y esquema Supabase DB
│   ├── index.ts                # Interfaces del Dominio en Español
│   └── supabase.ts             # Tipos autogenerados de Supabase PostgreSQL
├── .env.local                  # Credenciales locales de Supabase y R2
├── .gitignore                  # Exclusiones de Git
├── package.json                # Dependencias del proyecto
└── vercel.json                 # Configuración de despliegue en Vercel
```

---

## 🗄️ Esquema de Base de Datos en Supabase PostgreSQL

- `usuarios`: Cuentas de usuario, contraseñas y matriz de permisos por roles.
- `clientes`: Directorio de casilleros `AMEX-PER-XXXX`, Ubigeo SUNAT y DNI.
- `embarques_master`: Manifiestos de sacas Tib Courier y Guías Máster AMEX (`AMX0000001269`).
- `paquetes`: Inventario de recibos de bodega (*WR#*), tracking USA, peso y URLs de facturas PDF en R2.
- `ordenes_liquidacion`: Liquidaciones aduaneras en Soles/Dólares y vouchers de pago Yape/BCP.
- `historial_trazabilidad`: Registro cronológico de eventos y trazabilidad por paquete.

---

## ⚡ Comandos Rápidos

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo local
npm run dev

# Compilar producción
npm run build
```
