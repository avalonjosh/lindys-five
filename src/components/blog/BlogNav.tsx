import { Link, useLocation } from 'react-router-dom';

export default function BlogNav() {
  const location = useLocation();
  const currentPath = location.pathname;

  const tabs = [
    { path: '/blog', label: 'All Posts', exact: true },
    { path: '/blog/sabres', label: 'Sabres', exact: false },
    { path: '/blog/bills', label: 'Bills', exact: false },
  ];

  const isActive = (tab: typeof tabs[0]) => {
    if (tab.exact) {
      return currentPath === tab.path;
    }
    return currentPath.startsWith(tab.path);
  };

  return (
    <nav className="flex gap-8">
      {tabs.map((tab) => {
        const active = isActive(tab);
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={`text-lg font-semibold pb-2 transition-colors ${
              active
                ? 'text-gray-900'
                : 'text-gray-400 hover:text-gray-900 border-b-2 border-transparent'
            }`}
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              borderBottom: active ? '3px solid #003087' : undefined,
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
