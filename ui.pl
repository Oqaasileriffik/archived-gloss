#!/usr/bin/env perl
# -*- mode: cperl; indent-tabs-mode: nil; tab-width: 3; cperl-indent-level: 3; -*-
use strict;
use warnings;
use utf8;

BEGIN {
	$| = 1;
	binmode(STDIN, ':encoding(UTF-8)');
	binmode(STDOUT, ':encoding(UTF-8)');
}
use open qw( :encoding(UTF-8) :std );
use feature qw(unicode_strings current_sub);
use POSIX qw(ceil);
use Digest::SHA qw(sha1_base64);
use File::Basename;
use File::Spec;

if ((($ENV{LANGUAGE} || "").($ENV{LANG} || "").($ENV{LC_ALL} || "")) !~ /UTF-?8/i) {
   die "Locale is not UTF-8 - bailing out!\n";
}
if ($ENV{PERL_UNICODE} !~ /S/ || $ENV{PERL_UNICODE} !~ /D/ || $ENV{PERL_UNICODE} !~ /A/) {
   die "Envvar PERL_UNICODE must contain S and D and A!\n";
}

use FindBin qw($Bin);
use lib "$Bin/";
use Helpers;

use Getopt::Long;
Getopt::Long::Configure('no_ignore_case');
my %opts = ();
GetOptions(\%opts,
   'port|p=i',
   );

my @bins = glob('./*.pl');
if (scalar(@bins)) {
   $opts{'binary'} = $bins[0];
}

my $cmd = `$opts{binary} --cmd`;
chomp($cmd);
if (!$cmd) {
   die "Could not call '$opts{binary} --cmd'!\n";
}

my @cmds = split(/\|/, $cmd);

my $tmpdir = File::Spec->tmpdir();
for (my $i=0 ; $i<scalar(@cmds) ; ++$i) {
   $cmds[$i] .= " 2> $tmpdir/ui-err-$i.txt | tee $tmpdir/ui-out-$i.txt";
}
$cmd = join(' | ', @cmds);
#print "Using pipe:\n  ".join(" | \\\n  ", @cmds)."\n";

if (!defined $opts{'port'} || !$opts{'port'} || $opts{'port'} < 1) {
   $opts{'port'} = $ENV{'REGTEST_PORT'} || 3500;
}

use Plack::Runner;
use Plack::Builder;
use Plack::Request;
use JSON;

my $do_gloss = sub {
   my ($t) = @_;
   my @rv = ();

   file_put_contents("$tmpdir/ui-in.txt", $t);
   file_put_contents("$tmpdir/ui-cmd.txt", $cmd);
   `cat $tmpdir/ui-in.txt | $cmd >/dev/null 2>$tmpdir/ui-err.txt`;
   for (my $i=0 ; $i<scalar(@cmds) ; ++$i) {
      my $out = file_get_contents("$tmpdir/ui-out-$i.txt");
      push(@rv, $out);
   }

   return \@rv;
};

my $handle_callback = sub {
   my ($req) = @_;

   if (!defined $req->parameters->{'a'}) {
      return [400, ['Content-Type' => 'text/plain'], ['Parameter a must be passed!']];
   }

   my %rv = ();
   my $status = 200;

   if ($req->parameters->{'a'} eq 'gloss') {
      if (!defined $req->parameters->{'t'}) {
         return [400, ['Content-Type' => 'text/plain'], ['Parameter t must be passed!']];
      }
      $rv{'output'} = $do_gloss->($req->parameters->{'t'});
   }

   $rv{'a'} = $req->parameters->{'a'};

   return [$status, ['Content-Type' => 'application/json'], [JSON->new->utf8(1)->pretty(1)->encode(\%rv)]];
};

my $app = sub {
   my $env = shift;
   my $req = Plack::Request->new($env);

   if (!$req->path_info || $req->path_info eq '/') {
      open my $fh, '<:raw', "$Bin/static/index.html" or die $!;
      return [200, ['Content-Type' => 'text/html'], $fh];
   }
   elsif ($req->path_info eq '/callback') {
      return $handle_callback->($req);
   }
   return [404, ['Content-Type' => 'text/plain; charset=UTF-8'], ['File not found!']];
};

my $url = $ENV{'REGTEST_URL'} || "http://localhost:$opts{'port'}/";
print "Open your browser and navigate to $url\n";

my $builder = Plack::Builder->new;
$builder->add_middleware('Deflater');
$builder->add_middleware('Static', path => qr{^/static/}, root => "$Bin/");
$app = $builder->wrap($app);

`rm -f /tmp/access-ui-*.log`;

my $runner = Plack::Runner->new;
$runner->parse_options('--access-log', '/tmp/access-ui-'.$$.'.log', '-o', 'localhost', '-p', $opts{'port'});
$runner->run($app);
