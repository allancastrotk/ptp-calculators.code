import React from "react";

import { Alert } from "./Alert";

export function ErrorBanner({ message }: { message: string }) {
  return <Alert message={message} tone="error" />;
}