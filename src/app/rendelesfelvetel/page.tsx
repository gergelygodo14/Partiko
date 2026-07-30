import OrderEntryScreen from "./OrderEntryScreen";

// Order entry for phoned-in sandwich orders - replaces the hand-maintained
// rendelések.xlsx. Writes straight into SandwichOrder/SandwichOrderLine, so the
// summaries, meat-prep figures and kitchen printouts on /rendelesek pick these
// up with no extra step.
export default function RendelesfelvetelPage() {
  return <OrderEntryScreen />;
}
