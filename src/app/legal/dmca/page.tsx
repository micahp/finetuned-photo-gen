import { Navbar } from '@/components/navigation/navbar'

export const metadata = {
  title: 'DMCA Policy - Fine Photo Gen',
  description: 'DMCA copyright policy for Fine Photo Gen AI image generation service'
}

export default function DMCAPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">DMCA Policy</h1>
          <p className="text-sm text-gray-600 mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-gray max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Reporting Copyright Infringement</h2>
              <p className="mb-4">
                Fine Photo Gen respects the intellectual property rights of others and expects our users to do the same. 
                If you believe that content on our platform infringes your copyright, please send a written notice that includes:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Your contact information (name, address, phone number, email)</li>
                <li>A description of the copyrighted work you claim has been infringed</li>
                <li>A description of where the infringing content is located on our service</li>
                <li>A statement that you have a good faith belief that the use is not authorized</li>
                <li>A statement that the information in your notice is accurate and, under penalty of perjury, that you are authorized to act on behalf of the copyright owner</li>
                <li>Your physical or electronic signature</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">How to Submit a DMCA Notice</h2>
              <p className="mb-4">Send your DMCA notice to our designated agent:</p>
              <div className="bg-gray-100 p-4 rounded-lg">
                <p><strong>DMCA Agent</strong></p>
                <p>Email: <a href="mailto:theinnotivehype@gmail.com" className="text-blue-600 hover:text-blue-800">theinnotivehype@gmail.com</a></p>
                <p>Subject Line: "DMCA Takedown Request"</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Counter-Notification</h2>
              <p className="mb-4">
                If you believe your content was removed in error, you may file a counter-notification that includes:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Your contact information</li>
                <li>Identification of the removed content and its previous location</li>
                <li>A statement under penalty of perjury that you have a good faith belief the content was removed in error</li>
                <li>A statement consenting to jurisdiction of federal court in your district</li>
                <li>Your physical or electronic signature</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Repeat Infringer Policy</h2>
              <p>
                We will terminate the accounts of users who are repeat infringers of copyright in appropriate circumstances.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">AI-Generated Content Notice</h2>
              <p className="mb-4">
                Please note that our service generates AI-created images based on user prompts and trained models. 
                When reporting potential copyright infringement, please consider:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>AI-generated content may create images similar to existing works without direct copying</li>
                <li>Users may input prompts that reference copyrighted characters or concepts</li>
                <li>Training images uploaded by users must not violate copyright</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Response Time</h2>
              <p>
                We will respond to valid DMCA notices within 24-48 hours and remove infringing content promptly. 
                Counter-notifications will be processed according to DMCA procedures.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
} 