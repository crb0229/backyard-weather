// TEST: drawings and startup animations for the holiday themes on tv-test.html.
window.ART = {
  // The waving flag for the Fourth of July (filled in with the full drawing later)
  drawFlag(svg) { svg.innerHTML = '<rect x="15" y="25" width="70" height="40" fill="#b9524e"/>'; },
  // The Death Star for May the 4th, lit like tonight's moon (filled in with the full drawing later)
  drawDeathStar(svg) { svg.innerHTML = '<circle cx="50" cy="50" r="40" fill="#8a9099"/>'; }
};
