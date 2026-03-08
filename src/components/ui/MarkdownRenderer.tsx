import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
	content: string;
	className?: string;
}

const components: Components = {
	// Code blocks
	pre({ children, ...props }) {
		return (
			<pre
				className="
          font-mono text-sm
          bg-[var(--color-surface-secondary)]
          border border-[var(--color-border-subtle)]
          rounded-xl p-4 overflow-x-auto
          my-4 leading-relaxed
        "
				{...props}
			>
				{children}
			</pre>
		);
	},

	code({ className, children, ...props }) {
		const isInline = !className;
		if (isInline) {
			return (
				<code
					className="
            font-mono text-[0.85em]
            bg-[var(--color-surface-tertiary)]
            border border-[var(--color-border-subtle)]
            rounded px-1.5 py-0.5
            text-[var(--color-primary)]
            break-words
          "
					{...props}
				>
					{children}
				</code>
			);
		}
		return (
			<code
				className={`${className ?? ""} text-[var(--color-text)]`}
				{...props}
			>
				{children}
			</code>
		);
	},

	// Headings
	h1({ children, ...props }) {
		return (
			<h1
				className="text-xl font-semibold text-[var(--color-text)] mt-6 mb-3 first:mt-0"
				{...props}
			>
				{children}
			</h1>
		);
	},
	h2({ children, ...props }) {
		return (
			<h2
				className="text-base font-semibold text-[var(--color-text)] mt-5 mb-2.5 first:mt-0"
				{...props}
			>
				{children}
			</h2>
		);
	},
	h3({ children, ...props }) {
		return (
			<h3
				className="text-sm font-semibold text-[var(--color-text)] mt-4 mb-2 first:mt-0"
				{...props}
			>
				{children}
			</h3>
		);
	},
	h4({ children, ...props }) {
		return (
			<h4
				className="text-sm font-medium text-[var(--color-text)] mt-3 mb-1.5 first:mt-0"
				{...props}
			>
				{children}
			</h4>
		);
	},

	// Paragraph
	p({ children, ...props }) {
		return (
			<p
				className="text-[0.9375rem] text-[var(--color-text)] leading-7 mb-3.5 last:mb-0"
				{...props}
			>
				{children}
			</p>
		);
	},

	// Lists
	ul({ children, ...props }) {
		return (
			<ul
				className="list-disc pl-5 mb-3.5 space-y-1.5 text-[var(--color-text)]"
				{...props}
			>
				{children}
			</ul>
		);
	},
	ol({ children, ...props }) {
		return (
			<ol
				className="list-decimal pl-5 mb-3.5 space-y-1.5 text-[var(--color-text)]"
				{...props}
			>
				{children}
			</ol>
		);
	},
	li({ children, ...props }) {
		return (
			<li
				className="text-[0.9375rem] leading-7 text-[var(--color-text)] pl-0.5"
				{...props}
			>
				{children}
			</li>
		);
	},

	// Blockquote
	blockquote({ children, ...props }) {
		return (
			<blockquote
				className="
          border-l-[3px] border-[var(--color-primary)]
          pl-4 my-4
          text-[var(--color-text-secondary)]
          italic
        "
				{...props}
			>
				{children}
			</blockquote>
		);
	},

	// Horizontal rule
	hr({ ...props }) {
		return (
			<hr
				className="border-none border-t border-[var(--color-border)] my-5"
				{...props}
			/>
		);
	},

	// Strong / Em
	strong({ children, ...props }) {
		return (
			<strong className="font-semibold text-[var(--color-text)]" {...props}>
				{children}
			</strong>
		);
	},
	em({ children, ...props }) {
		return (
			<em className="italic text-[var(--color-text-secondary)]" {...props}>
				{children}
			</em>
		);
	},

	// Link
	a({ children, href, ...props }) {
		return (
			<a
				href={href}
				target="_blank"
				rel="noopener noreferrer"
				className="
          text-[var(--color-primary)] underline underline-offset-2
          hover:opacity-75 transition-opacity duration-150
        "
				{...props}
			>
				{children}
			</a>
		);
	},

	// Table
	table({ children, ...props }) {
		return (
			<div className="overflow-x-auto my-4 rounded-xl border border-[var(--color-border)]">
				<table className="w-full text-sm border-collapse" {...props}>
					{children}
				</table>
			</div>
		);
	},
	thead({ children, ...props }) {
		return (
			<thead className="bg-[var(--color-surface-secondary)]" {...props}>
				{children}
			</thead>
		);
	},
	tbody({ children, ...props }) {
		return (
			<tbody
				className="divide-y divide-[var(--color-border-subtle)]"
				{...props}
			>
				{children}
			</tbody>
		);
	},
	tr({ children, ...props }) {
		return (
			<tr
				className="hover:bg-[var(--color-surface-secondary)] transition-colors duration-100"
				{...props}
			>
				{children}
			</tr>
		);
	},
	th({ children, ...props }) {
		return (
			<th
				className="
          px-4 py-2.5 text-left text-xs font-semibold
          text-[var(--color-text-secondary)] uppercase tracking-wider
        "
				{...props}
			>
				{children}
			</th>
		);
	},
	td({ children, ...props }) {
		return (
			<td
				className="px-4 py-2.5 text-[var(--color-text-secondary)] text-sm"
				{...props}
			>
				{children}
			</td>
		);
	},
};

export function MarkdownRenderer({
	content,
	className = "",
}: MarkdownRendererProps) {
	return (
		<div className={`min-w-0 ${className}`}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={[rehypeHighlight]}
				components={components}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
