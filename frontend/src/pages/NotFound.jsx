import { Link } from "react-router-dom";
import { Empty } from "../components/ui";

export default function NotFound() {
  return (
    <Empty title="This page doesn't exist" action={<Link to="/" className="btn btn-primary">Back to start</Link>}>
      The address may be mistyped, or the page has moved.
    </Empty>
  );
}
