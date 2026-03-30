function ImageCard({
  src,
  alt = "Generated image",
  downloadName,
}) {
  return (
    <figure className="image-card-wrap">
      <img className="image-card" src={src} alt={alt} loading="lazy" />
      {downloadName ? (
        <a
          href={src}
          download={downloadName}
          className="image-card-download btn btn-secondary"
        >
          Download
        </a>
      ) : null}
    </figure>
  );
}

export default ImageCard;
