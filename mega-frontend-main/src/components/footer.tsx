export function Footer() {
  return (
    <footer className="bg-gray-50 border-t">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">About Us</h3>
            <p className="text-sm text-gray-600">
              PolicySense helps you manage all your insurance policies in one place, powered by AI to optimize your coverage.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <a href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</a>
              </li>
              <li>
                <a href="/policies" className="text-sm text-gray-600 hover:text-gray-900">Policies</a>
              </li>
              <li>
                <a href="/claims" className="text-sm text-gray-600 hover:text-gray-900">Claims</a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Support</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-sm text-gray-600 hover:text-gray-900">Help Center</a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-600 hover:text-gray-900">Contact Us</a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-600 hover:text-gray-900">FAQs</a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-sm text-gray-600 hover:text-gray-900">Privacy Policy</a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-600 hover:text-gray-900">Terms of Service</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-gray-200 pt-8">
          <p className="text-sm text-gray-600 text-center">
            © {new Date().getFullYear()} PolicySense. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
