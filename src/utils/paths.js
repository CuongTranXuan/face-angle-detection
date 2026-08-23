const publicBase = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

export function publicAsset(path) {
  const cleanPath = path.replace(/^\//, '');
  return `${publicBase}/${cleanPath}`;
}
