export async function loadOpenAccessArtworks(query = "Claude Monet") {
  const response = await fetch(`/api/artworks?q=${encodeURIComponent(query)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Museum collection request failed (${response.status})`);
  const payload = await response.json();
  return Array.isArray(payload.artworks) ? payload.artworks : [];
}
