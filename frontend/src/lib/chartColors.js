// A restrained palette in the brand's lavender/blue family, with a few warm and green
// accents so up to ten topic clusters stay distinguishable on the scatter plot.
export const CLUSTER_COLORS = [
  "#6355E0", // indigo
  "#2F80ED", // blue
  "#14A38B", // teal
  "#D9548E", // rose
  "#F2994A", // amber
  "#8E7CF5", // lavender
  "#4FB3E8", // sky
  "#6BAA3A", // green
  "#B455D6", // orchid
  "#7A869A", // slate
];

export const clusterColor = (i) => CLUSTER_COLORS[i % CLUSTER_COLORS.length];
