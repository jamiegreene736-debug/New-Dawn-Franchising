import type { ReactNode } from "react";

type ReadMoreProps = {
  id: string;
  title: string;
  children: ReactNode;
};

export function ReadMore({ id, title, children }: ReadMoreProps) {
  return (
    <details className="v6-disclosure" id={id}>
      <summary>
        <strong>{title}</strong>
        <span className="v6-read-label" aria-hidden="true">
          <b className="v6-more">Read more</b>
          <b className="v6-less">Show less</b>
        </span>
        <i className="v6-toggle" aria-hidden="true" />
      </summary>
      {children}
    </details>
  );
}
