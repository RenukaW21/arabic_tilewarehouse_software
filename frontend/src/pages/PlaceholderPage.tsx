const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-[60vh] text-center">
    <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center mb-4">
      <span className="text-2xl">🚧</span>
    </div>
    <h2 className="font-display font-bold text-lg text-foreground">{title}</h2>
    <p className="text-sm text-muted-foreground mt-1">This module is coming soon.</p>
  </div>
);

export default PlaceholderPage;
