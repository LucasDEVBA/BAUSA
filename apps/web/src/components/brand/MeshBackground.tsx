interface MeshBackgroundProps {
  blobs?: Array<"b1" | "b2" | "b3" | "b4">;
  grid?: boolean;
  className?: string;
}

/** Malha de gradiente viva (azul/bordô) com grão — o "fundo de luz" da identidade. */
export default function MeshBackground({ blobs = ["b1", "b2", "b3", "b4"], grid = false, className = "" }: MeshBackgroundProps) {
  return (
    <div className={`ba-mesh ${className}`} aria-hidden="true">
      {blobs.map((blob) => (
        <div key={blob} className={`ba-blob ba-${blob}`} />
      ))}
      {grid && <div className="ba-grid" />}
      <div className="ba-grain" />
    </div>
  );
}
