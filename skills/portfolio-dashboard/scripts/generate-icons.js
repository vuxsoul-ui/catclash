// Simple SVG icon generator - black square with white K
const fs = require('fs');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

sizes.forEach(size => {
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#000"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
          fill="#fff" font-family="Arial" font-weight="bold" font-size="${size * 0.6}">K</text>
  </svg>`;
  
  // For now, create a placeholder - in production you'd convert SVG to PNG
  fs.writeFileSync(`./public/icon-${size}x${size}.svg`, svg);
});

console.log('Icons created!');
