'use client';

import * as React from 'react';
import { AppShell } from '@/components/AppShell';
import { Stack, Flex } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/Table';

export default function ApiKeysPage() {
  const [keys, setKeys] = React.useState([
    { name: 'CI/CD Dev Deployment key', prefix: 'sc_live_****3a1c', created: '2 days ago' },
  ]);

  const generateKey = () => {
    const newKey = {
      name: `API key-${Date.now().toString().slice(-4)}`,
      prefix: 'sc_live_****' + Math.floor(1000 + Math.random() * 9000).toString(16),
      created: 'Just now',
    };
    setKeys([newKey, ...keys]);
  };

  return (
    <AppShell>
      <Stack spacing={24}>
        <Flex justify="between" align="center" className="gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">API Access Keys</h1>
            <p className="text-xs text-muted-foreground">Manage workspace keys to trigger Sculra scans from CLI and CI pipelines.</p>
          </div>
          <Button variant="accent" size="sm" onClick={generateKey}>
            Generate Key
          </Button>
        </Flex>

        <Card className="glass-panel w-full overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-4xs uppercase tracking-wider">Key Name</TableHead>
                  <TableHead className="text-4xs uppercase tracking-wider">API Token</TableHead>
                  <TableHead className="text-4xs uppercase tracking-wider">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.prefix} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="text-xs font-semibold text-foreground">{key.name}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{key.prefix}</TableCell>
                    <TableCell className="text-xs font-medium text-muted-foreground">{key.created}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Stack>
    </AppShell>
  );
}
