# AWS S3 Setup para SubiteYa

## 1. Crear Bucket Privado

```bash
# Crear bucket
aws s3 mb s3://subiteya-videos --region us-east-1

# Bloquear acceso público
aws s3api put-public-access-block \
  --bucket subiteya-videos \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

## 2. Configurar Lifecycle Policy (Limpiar videos temp)

Crear archivo `lifecycle.json`:

```json
{
  "Rules": [
    {
      "Id": "DeleteTempFilesAfter1Day",
      "Filter": {
        "Prefix": "temp/"
      },
      "Status": "Enabled",
      "Expiration": {
        "Days": 1
      }
    },
    {
      "Id": "DeleteEditedVideosAfter30Days",
      "Filter": {
        "Prefix": "videos/"
      },
      "Status": "Enabled",
      "Expiration": {
        "Days": 30
      }
    }
  ]
}
```

Aplicar policy:

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket subiteya-videos \
  --lifecycle-configuration file://lifecycle.json
```

## 3. Configurar CORS (si necesitas upload directo desde frontend)

Crear archivo `cors.json`:

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": [
        "https://subite-ya-web.vercel.app",
        "http://localhost:5173"
      ],
      "AllowedMethods": ["PUT", "POST", "GET"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

Aplicar CORS:

```bash
aws s3api put-bucket-cors \
  --bucket subiteya-videos \
  --cors-configuration file://cors.json
```

## 4. Crear Usuario IAM con Permisos Limitados

```bash
# Crear usuario
aws iam create-user --user-name subiteya-uploader

# Crear policy con permisos mínimos
cat > s3-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::subiteya-videos",
        "arn:aws:s3:::subiteya-videos/*"
      ]
    }
  ]
}
EOF

# Aplicar policy al usuario
aws iam put-user-policy \
  --user-name subiteya-uploader \
  --policy-name SubiteYaS3Access \
  --policy-document file://s3-policy.json

# Crear access keys
aws iam create-access-key --user-name subiteya-uploader
```

Guarda el output (Access Key ID y Secret Access Key) en tus variables de entorno.

## 5. Configurar Variables de Entorno

En Render.com (o tu plataforma):

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
S3_BUCKET_NAME=subiteya-videos
```

## 6. Verificar Configuración

```bash
# Listar contenido del bucket
aws s3 ls s3://subiteya-videos/

# Subir archivo de prueba
echo "test" > test.txt
aws s3 cp test.txt s3://subiteya-videos/temp/test.txt

# Verificar que se subió
aws s3 ls s3://subiteya-videos/temp/

# Limpiar
aws s3 rm s3://subiteya-videos/temp/test.txt
rm test.txt
```

## 7. Costos Estimados

Para 1000 videos/mes (100MB promedio):

- **Storage**: 100GB × $0.023/GB = $2.30/mes
- **PUT requests**: 2000 (upload + move) × $0.005/1000 = $0.01
- **GET requests**: 3000 × $0.0004/1000 = $0.001
- **Data transfer OUT**: ~5GB × $0.09/GB = $0.45

**Total estimado: ~$3/mes**

## 8. Alternativas

### Cloudflare R2 (Compatible con S3, más barato)

```env
AWS_REGION=auto
AWS_ACCESS_KEY_ID=your_r2_access_key
AWS_SECRET_ACCESS_KEY=your_r2_secret_key
S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
S3_FORCE_PATH_STYLE=true
S3_BUCKET_NAME=subiteya-videos
```

**Ventajas**:

- Sin costos de egress (data transfer OUT = $0)
- Storage: $0.015/GB (35% más barato que S3)

### Supabase Storage (Para proyectos pequeños)

Si ya usas Supabase, puedes usar su storage built-in en lugar de S3.

## 9. Seguridad

✅ **Bucket privado** - No accesible públicamente
✅ **Presigned URLs** - Acceso temporal (1 hora) para descargas
✅ **Usuario IAM limitado** - Solo permisos necesarios
✅ **Lifecycle policies** - Auto-limpieza de archivos temporales
✅ **Encryption at rest** - S3 encripta automáticamente

## 10. Monitoreo

```bash
# Ver tamaño total del bucket
aws s3 ls s3://subiteya-videos --recursive --summarize

# Ver objetos más grandes
aws s3api list-objects-v2 \
  --bucket subiteya-videos \
  --query "sort_by(Contents, &Size)[-10:].[Key,Size]" \
  --output table
```

## Troubleshooting

**Error: Access Denied**

- Verifica que las credenciales AWS estén correctas
- Verifica que el usuario IAM tenga los permisos necesarios

**Error: Bucket not found**

- Verifica que `AWS_REGION` coincida con la región del bucket
- Verifica que `S3_BUCKET_NAME` esté correcto

**Videos no se eliminan automáticamente**

- Verifica que la lifecycle policy esté aplicada: `aws s3api get-bucket-lifecycle-configuration --bucket subiteya-videos`
