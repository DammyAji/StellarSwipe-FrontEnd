import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 forced-color-adjust-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90 forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText] forced-colors:border forced-colors:border-[ButtonText]",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText] forced-colors:border forced-colors:border-[ButtonText]",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground forced-colors:border-[ButtonText] forced-colors:text-[ButtonText]",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText] forced-colors:border forced-colors:border-[ButtonText]",
        ghost: "hover:bg-accent hover:text-accent-foreground forced-colors:text-[ButtonText] forced-colors:hover:border forced-colors:hover:border-[ButtonText]",
        link: "text-primary underline-offset-4 hover:underline forced-colors:text-[LinkText]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

/**
 * Props for the {@link Button} component.
 *
 * Extends all native `<button>` attributes plus CVA variant props.
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * When `true`, the button renders its child element directly via Radix
   * `<Slot>`, merging props onto the child instead of rendering a `<button>`.
   * Useful for wrapping `<Link>` or other non-button elements with button styles.
   *
   * @default false
   */
  asChild?: boolean;
}

/**
 * Button — the primary interactive element used throughout the app.
 *
 * Supports multiple visual variants (`default`, `destructive`, `outline`,
 * `secondary`, `ghost`, `link`) and sizes (`default`, `sm`, `lg`, `icon`).
 * Inherits all native `<button>` HTML attributes and forwards a ref.
 *
 * @example
 * // Default primary button
 * <Button onClick={handleTrade}>Place Order</Button>
 *
 * @example
 * // Destructive variant, small size
 * <Button variant="destructive" size="sm">Cancel</Button>
 *
 * @example
 * // Icon-only button
 * <Button variant="ghost" size="icon" aria-label="Close">
 *   <X className="h-4 w-4" />
 * </Button>
 *
 * @example
 * // Render as a Next.js Link (asChild)
 * <Button asChild variant="link">
 *   <Link href="/dashboard">Go to Dashboard</Link>
 * </Button>
 *
 * @see {@link https://storybook.stellarswipe.dev/?path=/docs/ui-button--docs Storybook — Button}
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
