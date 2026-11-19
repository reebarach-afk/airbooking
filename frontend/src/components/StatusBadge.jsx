const LABEL = { on_time: "On time", delayed: "Delayed", cancelled: "Cancelled" };

export default function StatusBadge({ status, delay = 0 }) {
  const text = status === "delayed" && delay ? `Delayed ${delay} min` : LABEL[status] ?? status;
  return <span className={`badge badge-${status}`}>{text}</span>;
}
