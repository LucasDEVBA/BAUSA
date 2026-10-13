import Image, { type StaticImageData } from "next/image";

export interface Focus {
  /** Ponto de interesse (rosto), em fração da largura (0 a 1). */
  x: number;
  /** Ponto de interesse, em fração da altura (0 a 1). */
  y: number;
  /** 1 = a imagem cobre a moldura pela largura; acima disso aproxima. */
  zoom?: number;
}

interface FocalImageProps {
  src: StaticImageData;
  alt: string;
  focus: Focus;
  /** Altura ÷ largura da moldura (1 = círculo/quadrado, 1.25 = 4:5). */
  frameRatio: number;
  /** sizes do next/image já considerando o zoom (a imagem é maior que a moldura). */
  sizes: string;
  className?: string;
  priority?: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Recorte com ponto focal: as peças da marca são pôsteres 9:16 com texto e o rosto fora do
 * centro, e object-position sozinho não aproxima. A imagem inteira é posicionada para o rosto
 * ficar no centro da moldura, sem nunca deixar borda vazia.
 */
export default function FocalImage({ src, alt, focus, frameRatio, sizes, className = "", priority }: FocalImageProps) {
  const imageRatio = src.height / src.width;
  // Imagem mais "deitada" que a moldura precisa de zoom mínimo para cobrir a altura
  const zoom = Math.max(focus.zoom ?? 1, frameRatio / imageRatio);
  const width = zoom * 100;
  const height = ((zoom * imageRatio) / frameRatio) * 100;
  const left = clamp(50 - focus.x * width, 100 - width, 0);
  const top = clamp(50 - focus.y * height, 100 - height, 0);

  return (
    <span
      aria-hidden={alt ? undefined : true}
      className={`absolute block ${className}`}
      style={{ width: `${width}%`, height: `${height}%`, left: `${left}%`, top: `${top}%` }}
    >
      <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className="object-cover" />
    </span>
  );
}
