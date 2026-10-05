// Recover older cached entry pages without returning to the preview address.
const communityEntry = new URL('./', window.location.href);
communityEntry.search = window.location.search;
communityEntry.hash = window.location.hash;
communityEntry.searchParams.set('__cwb_release', '2026.10.05.6');
window.location.replace(communityEntry.href);
