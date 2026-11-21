import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/store/useOnboardingStore";
import { useGuidedTourStore } from "@/store/useGuidedTourStore";

/**
 * #1029 Help action that restarts the onboarding walkthrough from the first
 * step. Restarting keeps the persisted completion flag intact (no duplicate
 * completion state) and never touches account preferences.
 */
export function RestartWalkthroughButton() {
  const restart = useOnboardingStore((s) => s.restart);
  const replayTour = useGuidedTourStore((s) => s.replay);

  const handleRestart = () => {
    restart();
    replayTour();
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      className="gap-1.5"
      onClick={handleRestart}
      aria-label="Restart the onboarding walkthrough"
    >
      <HelpCircle size={16} aria-hidden="true" />
      <span className="hidden sm:inline">Help</span>
    </Button>
  );
}
