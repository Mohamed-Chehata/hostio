import { Check, MoreVertical, Share, Smartphone } from "lucide-react";

export function InstallSteps({ platform }) {
  const steps = platform === "iphone"
    ? [
        { text: "Open this page in Safari", icon: Smartphone, safariNote: true },
        { text: 'Tap the Share icon, then "Add to Home Screen"', icon: Share },
        { text: "Open Hostrack from your home screen", icon: Smartphone }
      ]
    : [
        { text: "Tap the three dots menu in the top right of your browser", icon: MoreVertical },
        { text: 'Tap "Install app" or "Add to Home Screen"', icon: Check },
        { text: "Open Hostrack from your home screen", icon: Smartphone }
      ];

  return (
    <ol className="space-y-3">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <li key={step.text} className="rounded-2xl bg-app/70 p-3">
            <div className="flex items-start gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-extrabold text-ink">{index + 1}</span>
              <span className="flex min-h-7 flex-1 items-center gap-2 text-left text-sm font-bold leading-5">
                <Icon size={16} className="shrink-0 text-accent" />
                {step.text}
              </span>
            </div>
            {step.safariNote && (
              <p className="ml-10 mt-2 rounded-2xl bg-[#78350F] px-3 py-2 text-left text-[11px] font-bold leading-4 text-[#FEF3C7]">
                Must be opened in Safari. Chrome and other browsers can't install apps on iPhone.
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
