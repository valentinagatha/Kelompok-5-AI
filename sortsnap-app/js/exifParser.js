function safeRatio(width, height) {
  if (!width || !height) return null;
  const w = Number(width);
  const h = Number(height);
  if (!w || !h) return null;
  return w / h;
}

export async function parseExif(file) {
  try {
    const exifr = window.exifr;
    const exif = await exifr.parse(file, {
      gps: true,
      exif: true,
      iptc: true,
      icc: false,
      translateKeys: true,
      translateValues: true,
      reviveValues: true
    });

    const width = exif?.ImageWidth || exif?.ExifImageWidth || exif?.PixelXDimension || null;
    const height = exif?.ImageHeight || exif?.ExifImageHeight || exif?.PixelYDimension || null;

    return {
      exif,
      width,
      height,
      ratio: safeRatio(width, height),
      hasCameraMeta: hasCameraMetadata(exif),
      dateTaken: exif?.DateTimeOriginal || exif?.CreateDate || exif?.ModifyDate || null
    };
  } catch (err) {
    // If exifr fails, try basic image dimensions via Image
    const dims = await getImageDimensions(file);
    return {
      exif: null,
      width: dims.width,
      height: dims.height,
      ratio: dims.ratio,
      hasCameraMeta: false,
      dateTaken: null
    };
  }
}

function hasCameraMetadata(exif) {
  if (!exif) return false;
  const keys = ['Make', 'Model', 'LensModel', 'FNumber', 'ExposureTime', 'ISO', 'ISOSpeedRatings', 'GPSLatitude', 'GPSLongitude'];
  return keys.some(key => exif[key] !== undefined && exif[key] !== null);
}

function getImageDimensions(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        ratio: img.naturalWidth / img.naturalHeight
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: null, height: null, ratio: null });
    };
    img.src = url;
  });
}
