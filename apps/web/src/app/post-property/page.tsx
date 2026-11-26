import type { Metadata } from "next";
import { StartListing } from "./StartListing";
export const metadata: Metadata = { title: "Post your property", description: "List your home, land or commercial property on ProperBySel. First listing free." };
export default function PostProperty() {
  return (
    <div className="container section" style={{ maxWidth: 760 }}>
      <h1>Post your property</h1>
      <p className="muted">Add your home, land or commercial space in eight short steps. Your progress saves automatically, so you can finish later. Every listing is reviewed before it goes live, usually within one working day.</p>
      <ul className="small"><li>First listing is free.</li><li>Your phone number stays private unless you choose to show it.</li><li>Have 3 or more clear photos ready.</li></ul>
      <StartListing />
    </div>
  );
}
