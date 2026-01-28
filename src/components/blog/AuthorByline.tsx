interface AuthorBylineProps {
  accentColor?: string;
}

export default function AuthorByline({ accentColor = '#003087' }: AuthorBylineProps) {
  return (
    <div className="mt-8 pt-6 border-t border-gray-200">
      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center border-2 overflow-hidden"
          style={{ borderColor: accentColor }}
        >
          <img
            src="/favicon.svg"
            alt="Lindy's Five"
            className="w-8 h-8"
          />
        </div>
        <div>
          <p className="text-sm text-gray-500">Written by</p>
          <p className="font-semibold text-gray-900">Lindy's Five Staff</p>
        </div>
      </div>
    </div>
  );
}
