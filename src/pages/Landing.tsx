import { useNavigate } from "react-router-dom";
import { Search, UserPlus, GraduationCap, Music, Dumbbell, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    title: "Discover Classes",
    desc: "Browse sports, arts, dance, music & tuition classes in your apartment.",
    icon: Search,
  },
  {
    title: "Enroll in One Tap",
    desc: "Pick a batch, register your family member, track everything.",
    icon: UserPlus,
  },
  {
    title: "For Instructors Too",
    desc: "List your classes, manage batches, track attendance & payments.",
    icon: GraduationCap,
  },
];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero */}
      <div className="flex flex-1 flex-col items-center px-6 pt-16 pb-8">
        {/* Logo */}
        <div className="mb-4 animate-fade-up" style={{ animationDelay: "0ms" }}>
          <img src="/logo-full.png" alt="CampusBee" className="h-20 object-contain" />
        </div>
        <p
          className="mb-8 max-w-xs text-center text-muted-foreground animate-fade-up"
          style={{ animationDelay: "160ms" }}
        >
          Every class your community needs. One tap away.
        </p>

        {/* Hero illustration card */}
        <div
          className="mb-10 w-full max-w-sm rounded-2xl gradient-primary p-6 animate-fade-up"
          style={{ animationDelay: "240ms" }}
        >
          <div className="flex items-center justify-center gap-5">
            {[Dumbbell, Music, Palette, GraduationCap].map((Icon, i) => (
              <div
                key={i}
                className="flex h-14 w-14 items-center justify-center rounded-xl bg-card/20 backdrop-blur-sm"
              >
                <Icon size={28} className="text-primary-foreground" />
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-sm font-medium text-primary-foreground/90">
            Sports · Music · Dance · Academics
          </p>
        </div>

        {/* CTA */}
        <Button
          onClick={() => navigate("/auth")}
          className="w-full max-w-sm gradient-primary text-primary-foreground h-14 text-base font-semibold rounded-xl shadow-lg shadow-primary/25 active:scale-[0.97] transition-transform animate-fade-up"
          style={{ animationDelay: "320ms" }}
        >
          Get Started
        </Button>

        {/* Feature cards */}
        <div className="mt-10 w-full max-w-sm space-y-3">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="flex items-start gap-4 rounded-xl bg-card p-4 shadow-sm animate-fade-up"
              style={{ animationDelay: `${400 + i * 80}ms` }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <f.icon size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-muted-foreground">
        Made for apartment communities across India 🇮🇳
      </footer>
    </div>
  );
};

export default Landing;
