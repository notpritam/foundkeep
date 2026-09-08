require 'json'

Pod::Spec.new do |s|
  s.name           = 'FoundkeepShared'
  s.version        = '1.0.0'
  s.summary        = 'Secure session and durable Share Extension queue for Foundkeep.'
  s.description    = s.summary
  s.license        = { :type => 'Proprietary' }
  s.author         = 'Foundkeep'
  s.homepage       = 'https://foundkeep.app'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :path => '.' }
  s.static_framework = true
  s.source_files   = '**/*.{h,m,mm,swift}'
  s.dependency 'ExpoModulesCore'
end
