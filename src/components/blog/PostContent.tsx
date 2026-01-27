import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface PostContentProps {
  content: string;
  accent?: string;
}

export default function PostContent({ content, accent = '#FCB514' }: PostContentProps) {
  return (
    <div className="prose prose-lg max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1
              className="text-3xl font-bold text-white mt-8 mb-4"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              className="text-2xl font-bold text-white mt-8 mb-4"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className="text-xl font-bold text-white mt-6 mb-3"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-gray-300 mb-4 leading-relaxed">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside text-gray-300 mb-4 space-y-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside text-gray-300 mb-4 space-y-1">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-gray-300">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className="pl-4 italic text-gray-400 my-4"
              style={{ borderLeft: `4px solid ${accent}` }}
            >
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="hover:underline"
              style={{ color: accent }}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-white">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-200">{children}</em>
          ),
          code: ({ children }) => (
            <code className="bg-black/30 px-1.5 py-0.5 rounded text-sm font-mono text-gray-200">
              {children}
            </code>
          ),
          hr: () => (
            <hr className="my-8 border-gray-600" />
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border-collapse border border-gray-600">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-600 bg-black/30 px-4 py-2 text-left font-semibold text-white">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-600 px-4 py-2 text-gray-300">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
