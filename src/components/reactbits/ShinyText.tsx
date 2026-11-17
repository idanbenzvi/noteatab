// Adapted from React Bits <ShinyText /> (light sweep over text).
export default function ShinyText({ text, speed = 5 }: { text: string; speed?: number }) {
  return <span className="shiny-text" style={{ animationDuration: `${speed}s` }}>{text}</span>;
}
