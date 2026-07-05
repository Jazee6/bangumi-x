import { cn } from "@/lib/utils.ts";

type TypographyVariant =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "p"
  | "blockquote"
  | "lead"
  | "large"
  | "small"
  | "muted"
  | "inlineCode";

const variantClasses: Record<TypographyVariant, string> = {
  h1: "scroll-m-20 text-3xl font-extrabold tracking-tight text-balance",
  h2: "scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight first:mt-0",
  h3: "scroll-m-20 text-xl font-semibold tracking-tight",
  h4: "scroll-m-20 text-lg font-semibold tracking-tight",
  p: "leading-7 [&:not(:first-child)]:mt-6",
  blockquote: "mt-6 border-l-2 pl-6 italic",
  lead: "text-lg text-muted-foreground",
  large: "text-base font-semibold",
  small: "text-xs leading-none font-medium",
  muted: "text-xs text-muted-foreground",
  inlineCode: "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-xs font-semibold",
};

interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  variant?: TypographyVariant;
  children: React.ReactNode;
}

function Typography({ variant = "p", className, children, ...props }: TypographyProps) {
  const classes = cn(variantClasses[variant], className);

  switch (variant) {
    case "h1":
      return (
        <h1 className={classes} {...props}>
          {children}
        </h1>
      );
    case "h2":
      return (
        <h2 className={classes} {...props}>
          {children}
        </h2>
      );
    case "h3":
      return (
        <h3 className={classes} {...props}>
          {children}
        </h3>
      );
    case "h4":
      return (
        <h4 className={classes} {...props}>
          {children}
        </h4>
      );
    case "blockquote":
      return (
        <blockquote className={classes} {...props}>
          {children}
        </blockquote>
      );
    case "inlineCode":
      return (
        <code className={classes} {...props}>
          {children}
        </code>
      );
    case "small":
      return (
        <small className={classes} {...props}>
          {children}
        </small>
      );
    case "lead":
    case "large":
    case "muted":
    case "p":
    default:
      return (
        <p className={classes} {...props}>
          {children}
        </p>
      );
  }
}

export { Typography };
export type { TypographyVariant, TypographyProps };
