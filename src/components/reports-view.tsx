
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Loader2, Clipboard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateWeeklyReport } from '@/ai/flows/generate-report-flow';
import { type Task } from './kanban-board';


export default function ReportsView({ tasks }: { tasks: Task[] }) {
  const [report, setReport] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerateReport = async () => {
    setIsLoading(true);
    setReport('');
    try {
      const result = await generateWeeklyReport({
        tasks: tasks,
        currentDate: new Date().toISOString(),
      });
      setReport(result.report);
      toast({
        title: 'Report Generated',
        description: 'The weekly task summary has been successfully generated.',
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        variant: 'destructive',
        title: 'Error Generating Report',
        description: 'There was a problem generating the report. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(report);
    toast({
        title: "Copied to Clipboard",
        description: "The report content is ready to be pasted.",
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Weekly Reports</h1>
          <p className="text-muted-foreground">
            Generate and view weekly summaries of task progress.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span>Generate New Report</span>
          </CardTitle>
          <CardDescription>
            Click the button to generate a summary of all tasks for the current week. The report will be generated in Markdown format, ready to be copied into a Google Doc.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Generating your report, please wait...</p>
            </div>
          ) : report ? (
            <div>
              <div className="flex justify-end mb-2">
                <Button variant="outline" size="sm" onClick={handleCopyToClipboard}>
                    <Clipboard className="mr-2 h-4 w-4"/> Copy to Clipboard
                </Button>
              </div>
              <Textarea
                readOnly
                value={report}
                className="w-full h-96 font-mono text-sm bg-muted/50"
                placeholder="Your generated report will appear here."
              />
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-16">
              <p>Click the button below to start.</p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleGenerateReport} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Weekly Report'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

    