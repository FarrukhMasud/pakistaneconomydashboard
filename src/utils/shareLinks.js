export function sectionUrl(groupId, sectionId, { embed = false, origin, pathname, search } = {}) {
  const href = `/${groupId}/${sectionId}`;
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://economyofpakistan.com');
  const currentPath = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  const currentSearch = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const url = new URL(href, base.endsWith('/') ? base : `${base}/`);
  if (currentPath === href) {
    const current = new URLSearchParams(currentSearch);
    current.forEach((value, key) => {
      if (key !== 'embed') url.searchParams.set(key, value);
    });
  }
  if (embed) url.searchParams.set('embed', '1');
  else url.searchParams.delete('embed');
  return url.toString();
}

export function embedSnippet(url, label) {
  const title = `${label} — Pakistan Economic Dashboard`;
  return `<iframe src="${url}" title="${title}" width="100%" height="720" loading="lazy" style="border:0;border-radius:12px;" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
}
