import { useState } from "react";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { beginLogin } from "@/lib/auth-client";

export function useLogin() {
  const [loggingIn, setLoggingIn] = useState(false);

  async function login(returnTo: string) {
    setLoggingIn(true);
    try {
      await beginLogin(returnTo);
    } catch (error) {
      setLoggingIn(false);
      toast.add({
        title: error instanceof Error ? error.message : "登录暂时无法完成，请重试。",
        type: "error",
        priority: "high",
      });
    }
  }

  return { loggingIn, login };
}

export function SignInEmpty({
  title,
  description,
  returnTo,
}: {
  title: string;
  description: string;
  returnTo: string;
}) {
  const { loggingIn, login } = useLogin();

  return (
    <Empty variant="outline" className="mt-6 min-h-72">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LogIn />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" disabled={loggingIn} onClick={() => void login(returnTo)}>
          {loggingIn ? <Spinner /> : <LogIn />}
          {loggingIn ? "登录中" : "登录"}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
