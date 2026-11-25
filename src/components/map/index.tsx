"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "../ui";
import type { IssueMapProps } from "./issue-map-inner";

export type { MapPoint } from "./issue-map-inner";

const Inner = dynamic(() => import("./issue-map-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-64 w-full" />,
});

/** Interactive Leaflet map, loaded on the client only. */
export function IssueMap(props: IssueMapProps) {
  return (
    <div style={{ height: props.height ?? 420 }} className="relative overflow-hidden rounded-lg border border-line">
      <Inner {...props} />
    </div>
  );
}
