import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "gb-f h-11 w-full min-w-0 rounded-xl px-[15px] text-[13px] text-fg transition outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg placeholder:text-mut disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-bad aria-invalid:focus:shadow-[0_0_0_4px_rgb(var(--bad)/0.15)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
