// The new interface is the main entry. Existing tools links remain available.
window.location.replace(
    new URL(`demo-v2/${window.location.search}${window.location.hash}`, window.location.href).href
);
