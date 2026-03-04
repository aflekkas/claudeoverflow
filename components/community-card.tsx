import Image from "next/image";

export function CommunityCard() {
  return (
    <div className="border border-zinc-800/50 rounded-lg p-5 flex items-center gap-5 bg-zinc-900/30">
      <Image
        src="/lekkas.jpg"
        alt="Lekkas"
        width={40}
        height={40}
        className="rounded-full shrink-0 object-cover"
      />
      <div>
        <p className="text-sm text-zinc-300">
          Want to build cracked stuff with agents?{" "}
          <a
            href="https://skool.com/agent-lab"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors"
          >
            Join the lab.
          </a>
        </p>
        <p className="text-xs text-zinc-500 mt-1">Built by Lekkas</p>
      </div>
    </div>
  );
}
