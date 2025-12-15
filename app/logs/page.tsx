import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { FileText, Mail, Activity, Clock } from 'lucide-react'

export default async function LogsPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    // Parallel fetching
    const [loginLogsRes, jobLogsRes] = await Promise.all([
        supabase
            .from('login_logs')
            .select('*')
            .eq('user_id', user.id)
            .order('login_at', { ascending: false })
            .limit(50),
        supabase
            .from('workflow_jobs')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50)
    ])

    const loginLogs = loginLogsRes.data || []
    const jobLogs = jobLogsRes.data || []

    return (
        <div className="flex min-h-screen flex-col bg-gray-950 text-white p-6 md:p-12 font-sans selection:bg-blue-500/30">
            <div className="mx-auto w-full max-w-6xl space-y-12">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-800 pb-8">
                    <div>
                        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-2">
                            Activity Logs
                        </h1>
                        <p className="text-gray-400">Track your automation jobs and account security.</p>
                    </div>
                    <a href="/" className="px-5 py-2.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-all font-medium border border-gray-700 hover:border-gray-500 shadow-lg">
                        Back to Dashboard
                    </a>
                </div>

                {/* Workflow Jobs Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 text-2xl font-bold text-gray-200">
                        <Activity className="text-green-400 h-8 w-8" />
                        <h2>Workflow History</h2>
                    </div>

                    <div className="rounded-2xl bg-gray-900 border border-gray-800 shadow-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-400">
                                <thead className="bg-gray-800/80 text-gray-300 uppercase font-semibold tracking-wider">
                                    <tr>
                                        <th className="px-6 py-5">Date</th>
                                        <th className="px-6 py-5">PDF File</th>
                                        <th className="px-6 py-5">Email Subject</th>
                                        <th className="px-6 py-5 text-center">Processed</th>
                                        <th className="px-6 py-5 text-center text-green-400">Success</th>
                                        <th className="px-6 py-5 text-center text-red-400">Errors</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {jobLogs.length > 0 ? jobLogs.map((job) => (
                                        <tr key={job.id} className="hover:bg-gray-800/30 transition-colors group">
                                            <td className="px-6 py-4 whitespace-nowrap font-mono text-gray-500">
                                                {new Date(job.created_at).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-blue-300 flex items-center gap-2">
                                                <FileText className="h-4 w-4 opacity-50" />
                                                {job.pdf_filename}
                                            </td>
                                            <td className="px-6 py-4 text-gray-300">
                                                <div className="flex items-center gap-2 max-w-xs truncate" title={job.email_subject_template}>
                                                    <Mail className="h-4 w-4 opacity-50" />
                                                    {job.email_subject_template}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-gray-200">{job.total_processed}</td>
                                            <td className="px-6 py-4 text-center font-bold text-green-500 bg-green-900/10 rounded-lg">{job.success_count}</td>
                                            <td className="px-6 py-4 text-center font-bold text-red-500 bg-red-900/10 rounded-lg">{job.error_count}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                                No workflow jobs found. Start processing files to see them here.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* Login Logs Section */}
                <section className="space-y-6 pt-8 border-t border-gray-800/50">
                    <div className="flex items-center gap-3 text-xl font-bold text-gray-400">
                        <Clock className="text-blue-400 h-6 w-6" />
                        <h2>Login History</h2>
                    </div>

                    <div className="rounded-2xl bg-gray-900/50 border border-gray-800 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-500">
                                <thead className="bg-gray-800/30 text-gray-400 uppercase font-medium">
                                    <tr>
                                        <th className="px-6 py-4">Time</th>
                                        <th className="px-6 py-4">Email</th>
                                        <th className="px-6 py-4">IP Address</th>
                                        <th className="px-6 py-4">User Agent</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800/50">
                                    {loginLogs.length > 0 ? loginLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-gray-800/20 transition-colors">
                                            <td className="px-6 py-3 whitespace-nowrap font-mono">
                                                {new Date(log.login_at).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-3">{log.email}</td>
                                            <td className="px-6 py-3 font-mono text-xs">{log.ip}</td>
                                            <td className="px-6 py-3 max-w-md truncate text-xs" title={log.user_agent}>
                                                {log.user_agent}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-gray-600">
                                                No login history found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

            </div>
        </div>
    )
}
