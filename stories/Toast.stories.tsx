import type { Meta, StoryObj } from "@storybook/react";
import { ToastProvider } from "@/components/ui/toast";
import { useToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";

const meta: Meta<typeof ToastProvider> = {
  title: "UI/Toast",
  component: ToastProvider,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="min-h-[200px] relative">
        <Story />
        <ToastProvider />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ToastProvider>;

function ToastTrigger({ tone, title, description }: { tone: "success" | "error" | "info"; title: string; description?: string }) {
  const toast = useToast();
  return (
    <Button onClick={() => toast[tone](title, { description })}>
      Show {tone} toast
    </Button>
  );
}

export const Success: Story = {
  render: () => <ToastTrigger tone="success" title="Trade executed" description="XLM/USDC order placed successfully." />,
};

export const Error: Story = {
  render: () => <ToastTrigger tone="error" title="Transaction failed" description="Insufficient balance." />,
};

export const Info: Story = {
  render: () => <ToastTrigger tone="info" title="Signal updated" description="New price target available." />,
};

export const AllTones: Story = {
  render: () => (
    <div className="flex gap-3 flex-wrap">
      <ToastTrigger tone="success" title="Success" />
      <ToastTrigger tone="error" title="Error" />
      <ToastTrigger tone="info" title="Info" />
    </div>
  ),
};
