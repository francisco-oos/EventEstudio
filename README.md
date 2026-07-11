# SystemInvitaciones V6.3

## Separación correcta de cuentas

### Propietario / desarrollador

`leyva2636@gmail.com`

Es el superusuario de la plataforma. Puede:

- ver ventas, clientes, pagos y eventos globales;
- abrir cualquier evento en modo soporte;
- usar herramientas de desarrollo;
- crear y asignar clientes;
- revisar métricas globales.

Seleccionar un evento desde esta cuenta **no significa que sea su boda**. Sólo lo abre para soporte o supervisión.

### Cliente de la boda

`ariana@evento.local`

Es la cuenta que administra la boda Francisco & Ariana. Puede:

- modificar su invitación;
- importar invitados;
- ver confirmaciones;
- generar QR por mesa;
- descargar reportes;
- administrar fotografías;
- crear eventos adicionales si su plan lo permite.

No puede ver ni modificar el modo desarrollador.

## Cuenta, pago y alojamiento

Crear una cuenta no significa automáticamente que el cliente haya pagado.

Los estados posibles son:

- `trial`: periodo de prueba;
- `active`: plan pagado o activado;
- `past_due`: pago pendiente;
- `cancelled`: cancelado;
- `expired`: vencido.

El registro público crea una cuenta con prueba. El pago activa o renueva la suscripción.

Para la demostración, el seed deja la cuenta de Ariana con plan Premium activo y un pago de demostración registrado.

## Planes y varios eventos

Cada plan tiene `max_events`.

- Esencial: 1 evento.
- Premium: 3 eventos.
- Studio: 20 eventos.

Un cliente puede crear varios eventos mientras:

1. su prueba o suscripción siga vigente;
2. no haya alcanzado el límite de su plan.

## Modo desarrollador

- Sólo aparece para `owner` y `developer`.
- Nunca aparece en el panel cliente.
- El aviso público de desarrollo sólo debe mostrarse al abrir una invitación con `?preview=1`.
- Una invitación normal no muestra el aviso.

## QR por mesa

Las mesas se obtienen de los invitados del **evento activo**. Esta versión corrige un problema de sesión: al cambiar de propietario a cliente ya no reutiliza un `eventId` perteneciente a otra cuenta.

Por ello, al entrar como Ariana deben aparecer:

- Mesa 1
- Mesa 2
- Mesa 3
- Mesa demo

La mesa demo corresponde a la invitación de prueba.

## Acceso inicial

```text
Superusuario:
leyva2636@gmail.com
Cambiar123!

Cliente boda:
ariana@evento.local
Cambiar123!
```

## Prueba

```powershell
npm install
copy .env.example .env
npm run seed
npm run dev
```

Después abre:

```text
http://localhost:3000/admin.html
```


## Corrección V6.3.2

Se restauraron las rutas que el panel necesitaba:

- `GET /api/admin/settings`
- `PUT /api/admin/settings`
- `GET /api/admin/themes`
- carga de portada;
- carga de música;
- carga y eliminación de galería;
- carga y eliminación de referencias de vestimenta.

También se corrigió el cargador del panel para:

- verificar el tipo de contenido antes de ejecutar `response.json()`;
- mostrar qué sección falló;
- evitar que una página HTML 404 provoque `Unexpected token '<'`;
- detener el mensaje permanente “Cargando espacio de trabajo”.

Después de instalar, abre DevTools y recarga con `Ctrl + F5` para evitar que el navegador use un `admin.js` anterior.
