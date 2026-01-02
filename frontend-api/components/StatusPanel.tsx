import React from "react";

import { Card } from "./Card";

export function StatusPanel({ message }: { message: string }) {
  return (
    <Card>
      <div className="ptp-field__helper">{message}</div>
    </Card>
  );
}
